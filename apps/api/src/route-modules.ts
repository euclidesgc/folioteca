import { DocumentsModule } from "./documents/documents.module";
import { InstallationModule } from "./installation/installation.module";
import { MeModule } from "./me/me.module";
import { UnitTypesModule } from "./unit-types/unit-types.module";
import { UnitsModule } from "./units/units.module";

export const ROUTE_MODULES = [
  MeModule,
  DocumentsModule,
  InstallationModule,
  UnitTypesModule,
  UnitsModule,
];
