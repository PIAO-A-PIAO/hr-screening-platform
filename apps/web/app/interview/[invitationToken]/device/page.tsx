import { DeviceCheck } from "../../../../components/device-check";

export default async function Page({ params }: { params: Promise<{ invitationToken: string }> }) {
  const { invitationToken } = await params;
  return <DeviceCheck invitationToken={invitationToken} />;
}
