import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

interface ValidationError {
  property: string;
  constraints?: Record<string, string>;
  children?: ValidationError[];
}

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  errors?: Record<string, string[]>;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = HttpStatus[status] || 'Error';
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // class-validator 에러 처리
        if (Array.isArray(responseObj.message)) {
          const validationErrors = responseObj.message as (
            | string
            | ValidationError
          )[];
          errors = this.formatValidationErrors(validationErrors);
          message = '입력값 검증에 실패했습니다';
        } else {
          message = (responseObj.message as string) || 'Error';
        }

        error = (responseObj.error as string) || HttpStatus[status] || 'Error';
      } else {
        message = 'Error';
        error = HttpStatus[status] || 'Error';
      }
    } else if (exception instanceof Error) {
      // 예상치 못한 에러
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '서버 내부 오류가 발생했습니다';
      error = 'Internal Server Error';

      // 프로덕션이 아닌 환경에서는 상세 에러 로깅
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '알 수 없는 오류가 발생했습니다';
      error = 'Internal Server Error';

      this.logger.error('Unknown error', exception);
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (errors) {
      errorResponse.errors = errors;
    }

    // 에러 로깅 (5xx 에러만 error 레벨로)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status}: ${message}`,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} - ${status}: ${message}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  /**
   * class-validator 에러를 포맷팅
   * { field1: ['error1', 'error2'], field2: ['error3'] }
   */
  private formatValidationErrors(
    errors: (string | ValidationError)[],
  ): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    for (const error of errors) {
      if (typeof error === 'string') {
        // 단순 문자열 에러
        if (!result['_general']) {
          result['_general'] = [];
        }
        result['_general'].push(error);
      } else if (typeof error === 'object' && error !== null) {
        // ValidationError 객체
        this.extractValidationErrors(error, result);
      }
    }

    return result;
  }

  /**
   * 중첩된 ValidationError에서 에러 메시지 추출
   */
  private extractValidationErrors(
    error: ValidationError,
    result: Record<string, string[]>,
    parentPath: string = '',
  ): void {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      if (!result[path]) {
        result[path] = [];
      }
      result[path].push(...Object.values(error.constraints));
    }

    if (error.children && error.children.length > 0) {
      for (const child of error.children) {
        this.extractValidationErrors(child, result, path);
      }
    }
  }
}
