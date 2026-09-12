import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { SessionGuard, type SessionUser } from "../common/auth/session.guard";
import { CreateDocumentDto } from "./dto/create-document.dto";
import {
  DocumentCreatedDto,
  DocumentDetailDto,
  DocumentFavoriteStateDto,
  DocumentTrashStateDto,
} from "./dto/document-detail.dto";
import { DocumentListDto } from "./dto/document-summary.dto";
import { ListDocumentsQueryDto } from "./dto/list-documents.query.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { DocumentsService } from "./documents.service";

@ApiTags("documents")
@Controller("documents")
@UseGuards(SessionGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post()
  @ApiOperation({ operationId: "createDocument" })
  @ApiOkResponse({ type: DocumentCreatedDto })
  create(
    @CurrentUser() user: SessionUser,
    @Body() _body: CreateDocumentDto,
  ): Promise<DocumentCreatedDto> {
    return this.service.create(user.id);
  }

  @Get()
  @ApiOperation({ operationId: "listDocuments" })
  @ApiOkResponse({ type: DocumentListDto })
  async list(
    @CurrentUser() user: SessionUser,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentListDto> {
    const items = await this.service.list(user.id, query.filter);
    return { items };
  }

  @Get(":id")
  @ApiOperation({ operationId: "getDocument" })
  @ApiOkResponse({ type: DocumentDetailDto })
  getById(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<DocumentDetailDto> {
    return this.service.getById(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ operationId: "updateDocumentTitle" })
  @ApiOkResponse({ type: DocumentDetailDto })
  updateTitle(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: UpdateDocumentDto,
  ): Promise<DocumentDetailDto> {
    return this.service.updateTitle(user.id, id, body.title);
  }

  @Delete(":id")
  @ApiOperation({ operationId: "trashDocument" })
  @ApiOkResponse({ type: DocumentTrashStateDto })
  moveToTrash(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<DocumentTrashStateDto> {
    return this.service.moveToTrash(user.id, id);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: "restoreDocument" })
  @ApiOkResponse({ type: DocumentTrashStateDto })
  restore(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<DocumentTrashStateDto> {
    return this.service.restore(user.id, id);
  }

  @Delete(":id/permanent")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "deleteDocumentPermanently" })
  async deletePermanently(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<void> {
    await this.service.deletePermanently(user.id, id);
  }

  @Put(":id/favorite")
  @ApiOperation({ operationId: "favoriteDocument" })
  @ApiOkResponse({ type: DocumentFavoriteStateDto })
  favorite(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<DocumentFavoriteStateDto> {
    return this.service.favorite(user.id, id);
  }

  @Delete(":id/favorite")
  @ApiOperation({ operationId: "unfavoriteDocument" })
  @ApiOkResponse({ type: DocumentFavoriteStateDto })
  unfavorite(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<DocumentFavoriteStateDto> {
    return this.service.unfavorite(user.id, id);
  }
}
