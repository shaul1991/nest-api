import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('NestJS API')
    .setDescription('NestJS 기반 API 서버 문서')
    .setVersion('1.0.0')
    .addServer('http://localhost:3000', 'Local')
    .addServer('https://dev-api-nest.shaul.link', 'Development')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'JWT Access Token 입력',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', '인증 관련 API')
    .addTag('Users', '사용자 관련 API')
    .addTag('Health', '헬스체크 API')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'NestJS API Documentation',
  });
}
