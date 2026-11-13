import { SessionRefresher } from "./SessionRefresher";

export default async function SessionExpiredPage(props: PageProps<"/session-expired">) {
  const { final } = await props.searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <SessionRefresher final={final === "1"} />
    </main>
  );
}
