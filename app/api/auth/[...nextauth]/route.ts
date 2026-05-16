import NextAuth from "next-auth";
import { createAuthOptions } from "@/lib/auth";

const handler = NextAuth(createAuthOptions());

export { handler as GET, handler as POST };
