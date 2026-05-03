import { Catch, ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest<{ url: string }>();
    const status = exception.getStatus();

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      message: exception.message,
      timestamp: new Date().toISOString()
    });
  }
}
