-- ============================================================================
-- Enable Partial Indexes
-- ============================================================================

-- Active projects only
CREATE INDEX idx_projects_active ON projects (created_at) 
  WHERE deleted_at IS NULL;

-- Active deployments by status
CREATE INDEX idx_deployments_active_status ON deployments (project_id, status)
  WHERE deleted_at IS NULL AND status IN ('PENDING', 'BUILDING', 'DEPLOYING', 'RUNNING');

-- Containers needing health checks
CREATE INDEX idx_containers_healthy ON containers (last_health_check_at)
  WHERE deleted_at IS NULL 
    AND status = 'RUNNING' 
    AND health_status != 'HEALTHY';

-- Unused build caches
CREATE INDEX idx_build_caches_cleanup ON build_caches (expires_at, last_used_at)
  WHERE deleted_at IS NULL;

-- Failed deployments needing retry
CREATE INDEX idx_deployments_retryable ON deployments (project_id, created_at, status)
  WHERE deleted_at IS NULL 
    AND status = 'FAILED' 
    AND error IS NOT NULL;

-- ============================================================================
-- Version Locking
-- ============================================================================

-- Auto-increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deployment_version_trigger
  BEFORE UPDATE ON deployments
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER container_version_trigger
  BEFORE UPDATE ON containers
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER service_version_trigger
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

-- ============================================================================
-- Enable TimescaleDB Extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================================================
-- 1. METRICS (CRITICAL)
-- ============================================================================

SELECT create_hypertable(
  'metrics',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

ALTER TABLE metrics SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'source_id, metric',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('metrics', INTERVAL '1 day');
SELECT add_retention_policy('metrics', INTERVAL '90 days');

-- Continuous aggregates
CREATE MATERIALIZED VIEW metrics_1min
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 minute', timestamp) AS minute,
  source_id,
  source_type,
  metric,
  avg(value) AS avg_value,
  max(value) AS max_value,
  min(value) AS min_value,
  count(*) AS sample_count
FROM metrics
GROUP BY minute, source_id, source_type, metric
WITH NO DATA;

SELECT add_continuous_aggregate_policy('metrics_1min',
  start_offset => INTERVAL '3 minutes',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);

CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 hour', timestamp) AS hour,
  source_id,
  source_type,
  metric,
  avg(value) AS avg_value,
  max(value) AS max_value,
  min(value) AS min_value
FROM metrics
GROUP BY hour, source_id, source_type, metric
WITH NO DATA;

SELECT add_continuous_aggregate_policy('metrics_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

-- ============================================================================
-- 2. LOGS (CRITICAL)
-- ============================================================================

SELECT create_hypertable(
  'logs',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

ALTER TABLE logs SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'source_type, source_id, level',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('logs', INTERVAL '1 day');
SELECT add_retention_policy('logs', INTERVAL '30 days');

-- Continuous aggregate for log statistics
CREATE MATERIALIZED VIEW logs_hourly
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 hour', timestamp) AS hour,
  project_id,
  source_type,
  source_id,
  level,
  count(*) AS log_count,
  count(*) FILTER (WHERE level IN ('ERROR', 'FATAL')) AS error_count
FROM logs
GROUP BY hour, project_id, source_type, source_id, level
WITH NO DATA;

SELECT add_continuous_aggregate_policy('logs_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

-- ============================================================================
-- 3. BUILD LOGS (CRITICAL)
-- ============================================================================

SELECT create_hypertable(
  'build_logs',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

ALTER TABLE build_logs SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'deployment_id',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('build_logs', INTERVAL '7 days');
SELECT add_retention_policy('build_logs', INTERVAL '90 days');

-- ============================================================================
-- 4. AUDIT LOGS (IMPORTANT)
-- ============================================================================

SELECT create_hypertable(
  'audit_logs',
  'timestamp',
  chunk_time_interval => INTERVAL '1 month',
  if_not_exists => TRUE
);

ALTER TABLE audit_logs SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'user_id, resource_type, project_id',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('audit_logs', INTERVAL '90 days');
-- NO retention policy - keep forever for compliance

-- Continuous aggregate for compliance reporting
CREATE MATERIALIZED VIEW audit_logs_daily
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 day', timestamp) AS day,
  user_id,
  project_id,
  resource_type,
  action,
  count(*) AS action_count
FROM audit_logs
GROUP BY day, user_id, project_id, resource_type, action
WITH NO DATA;

SELECT add_continuous_aggregate_policy('audit_logs_daily',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);

-- ============================================================================
-- 5. WEBHOOK DELIVERIES (MODERATE)
-- ============================================================================

SELECT create_hypertable(
  'webhook_deliveries',
  'created_at',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

ALTER TABLE webhook_deliveries SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'webhook_id, event',
  timescaledb.compress_orderby = 'created_at DESC'
);

SELECT add_compression_policy('webhook_deliveries', INTERVAL '30 days');
SELECT add_retention_policy('webhook_deliveries', INTERVAL '1 year');

-- Continuous aggregate for webhook reliability
CREATE MATERIALIZED VIEW webhook_deliveries_daily
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 day', created_at) AS day,
  webhook_id,
  event,
  count(*) AS total_deliveries,
  count(*) FILTER (WHERE status_code = 200) AS successful_deliveries,
  count(*) FILTER (WHERE status_code IS NULL OR status_code >= 400) AS failed_deliveries,
  avg(EXTRACT(EPOCH FROM (delivered_at - created_at))) AS avg_delivery_time_seconds
FROM webhook_deliveries
GROUP BY day, webhook_id, event
WITH NO DATA;

SELECT add_continuous_aggregate_policy('webhook_deliveries_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day'
);

-- ============================================================================
-- 6. ALERT NOTIFICATIONS (MODERATE)
-- ============================================================================

SELECT create_hypertable(
  'alert_notifications',
  'timestamp',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

ALTER TABLE alert_notifications SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'channel_id, status',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('alert_notifications', INTERVAL '30 days');
SELECT add_retention_policy('alert_notifications', INTERVAL '6 months');