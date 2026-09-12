import { DocumentsModule } from "./documents/documents.module";
import { InstallationModule } from "./installation/installation.module";
import { MeModule } from "./me/me.module";

export const ROUTE_MODULES = [MeModule, DocumentsModule, InstallationModule];
