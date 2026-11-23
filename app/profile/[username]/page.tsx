import { ProfileScreen } from '@/components/ProfileScreen';

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <ProfileScreen username={username} />;
}
