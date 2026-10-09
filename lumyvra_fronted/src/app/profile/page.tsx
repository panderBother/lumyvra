import { Profile } from "@/components/profile";
export const metadata = { title: "个人中心" };
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = [
    "works",
    "drafts",
    "favorites",
    "history",
    "settings",
  ].includes(tab ?? "")
    ? tab!
    : "works";
  return (
    <div className="container page-space account-page">
      <Profile initialTab={initialTab} key={initialTab} />
    </div>
  );
}
