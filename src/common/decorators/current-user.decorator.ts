import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Permite escribir: someMethod(@CurrentUser() user: User)
// en vez de: someMethod(@Request() req) { const user = req.user }
export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
