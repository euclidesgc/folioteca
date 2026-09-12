import { DocumentsModule } from "./documents/documents.module";
import { InstallationModule } from "./installation/installation.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { MeModule } from "./me/me.module";
import { UnitTypesModule } from "./unit-types/unit-types.module";
import { UnitsModule } from "./units/units.module";
import { UsersModule } from "./users/users.module";

export const ROUTE_MODULES = [
  MeModule,
  DocumentsModule,
  InstallationModule,
  UnitTypesModule,
  UnitsModule,
  UsersModule,
  InvitationsModule,
];
