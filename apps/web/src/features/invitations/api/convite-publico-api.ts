import { httpClient } from "@/shared/api";
import type { AcceptInvitationDto, PublicInvitationDto } from "@/shared/api";

export async function getInvitationByToken(
  token: string,
  signal?: AbortSignal,
): Promise<PublicInvitationDto> {
  const response = await httpClient.get<PublicInvitationDto>(
    `/invitations/by-token/${token}`,
    { signal },
  );
  return response.data;
}

export async function acceptInvitation(
  token: string,
  dados: AcceptInvitationDto,
  signal?: AbortSignal,
): Promise<void> {
  await httpClient.post(`/invitations/${token}/accept`, dados, { signal });
}
