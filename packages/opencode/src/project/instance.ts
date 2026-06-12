import { context, type InstanceContext } from "./instance-context"
export type { InstanceContext } from "./instance-context"
export const Instance = {
  get current() { return context.use() },
  get directory() { return context.use().directory },
  get worktree() { return context.use().worktree },
  get project() { return context.use().project },
  bind<F extends (...args: any[]) => any>(fn: F): F {
    const ctx = context.use()
    return ((...args: any[]) => context.provide(ctx, () => fn(...args))) as F
  },
  restore<R>(ctx: InstanceContext, fn: () => R): R {
    return context.provide(ctx, fn)
  },
}
