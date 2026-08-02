import LoginCard from "@/components/LoginCard";

// Thin wrapper — the login UI lives in the shared <LoginCard> so /auth/signin
// and the chat logged-out state are guaranteed identical.
export default function SignIn() {
  return <LoginCard />;
}
