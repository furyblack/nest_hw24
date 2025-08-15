import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

//в домашнем задании есть случай когда надо проверить токен и извлечь данные из токена, но не блокировать запрос для анонимного пользователя
//для этого можно использовать подобный гард, переопределив handleRequest
//https://docs.nestjs.com/recipes/passport#extending-guards
@Injectable()
export class JwtOptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    console.log('🔥 JWT GUARD for:', req.url); // Добавь это
    console.log('AUTH HEADER:', req.headers['authorization']);
    return super.canActivate(context);
  }

  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ) {
    //super.handleRequest(err, user, info, context, status);
    // мы не будем вызывать здесь базовый метод суперкласса, в нём написано вот это:
    // кидаем ошибку если нет юзера или если другая ошибка (например JWT протух)...
    // handleRequest(err, user, info, context, status) {
    //   if (err || !user) {
    //     throw err || new common_1.UnauthorizedException();
    //   }
    //   return user;
    // }
    // а мы вернём просто null и не будем процессить ошибку и null
    if (err || !user) {
      return null;
    } else {
      return user;
    }
  }
}
