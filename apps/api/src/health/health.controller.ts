import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { HealthResponse } from "./dto/health-response.dto";

@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ operationId: "getHealth" })
  @ApiOkResponse({ type: HealthResponse })
  getHealth(): HealthResponse {
    return { status: "ok" };
  }
}
