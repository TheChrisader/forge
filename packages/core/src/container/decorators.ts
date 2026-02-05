import "reflect-metadata";

const INJECTABLE_KEY = Symbol("injectable");
const INJECT_KEY = Symbol("inject");

export function Injectable(): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(INJECTABLE_KEY, true, target);
    return target;
  };
}

export function Inject(key: string): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    const dependencies = Reflect.getMetadata(INJECT_KEY, target) || [];
    dependencies.push({ key, propertyKey });
    Reflect.defineMetadata(INJECT_KEY, dependencies, target);
  };
}

export function isInjectable(target: any): boolean {
  return Reflect.getMetadata(INJECTABLE_KEY, target) === true;
}

export function getInjections(target: any): Array<{ key: string; propertyKey: string | symbol }> {
  return Reflect.getMetadata(INJECT_KEY, target.prototype) || [];
}
