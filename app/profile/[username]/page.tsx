import { ProfileScreen } from '@/components/ProfileScreen';

export default function ProfilePage({ params }: { params: { username: string } }) {
  return <ProfileScreen username={params.username} />;
}
