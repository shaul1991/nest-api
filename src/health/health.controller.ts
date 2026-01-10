import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: '전체 헬스체크',
    description: '애플리케이션 및 데이터베이스 연결 상태를 확인합니다.',
  })
  @ApiOkResponse({ description: '정상 동작 중' })
  @ApiServiceUnavailableResponse({ description: '서비스 불가 상태' })
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness 체크',
    description: '애플리케이션이 실행 중인지 확인합니다 (K8s Liveness Probe).',
  })
  @ApiOkResponse({
    description: '애플리케이션 실행 중',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
      },
    },
  })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness 체크',
    description:
      '애플리케이션이 요청을 처리할 준비가 되었는지 확인합니다 (K8s Readiness Probe).',
  })
  @ApiOkResponse({ description: '요청 처리 준비 완료' })
  @ApiServiceUnavailableResponse({ description: '아직 준비되지 않음' })
  readiness() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
