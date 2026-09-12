import { httpClient } from "@/shared/api";
import type { CreateInvitationDto, InvitationResponseDto } from "@/shared/api";

export async function listInvitations(
  signal?: AbortSignal,
): Promise<InvitationResponseDto[]> {
  const response = await httpClient.get<InvitationResponseDto[]>("/invitations", {
    signal,
  });
  return response.data;
}

export async function createInvitation(
  dados: CreateInvitationDto,
  signal?: AbortSignal,
): Promise<InvitationResponseDto> {
  const response = await httpClient.post<InvitationResponseDto>("/invitations", dados, {
    signal,
  });
  return response.data;
}

export async function resendInvitation(
  id: string,
  signal?: AbortSignal,
): Promise<InvitationResponseDto> {
  const response = await httpClient.post<InvitationResponseDto>(
    `/invitations/${id}/resend`,
    undefined,
    { signal },
  );
  return response.data;
}

export async function revokeInvitation(id: string, signal?: AbortSignal): Promise<void> {
  await httpClient.delete(`/invitations/${id}`, { signal });
}
