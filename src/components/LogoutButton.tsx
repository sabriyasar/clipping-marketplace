import { logout } from "@/app/logout/actions";

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Logout
      </button>
    </form>
  );
}
