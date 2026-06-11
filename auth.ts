import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma, isDatabaseConfigured } from "@/lib/db/prisma";

function adminEmails() {
  return new Set(
    (process.env.AUTH_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function roleForEmail(email: string) {
  return adminEmails().has(email.toLowerCase()) ? "OWNER" : "MEMBER";
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in"
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email || !isDatabaseConfigured()) {
        return false;
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: user.email }
      });
      const role = roleForEmail(user.email);

      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: user.name || existingUser.name,
            role: role === "OWNER" ? "OWNER" : existingUser.role === "INVITED" ? "MEMBER" : existingUser.role
          }
        });
        return true;
      }

      const defaultPersona = await prisma.persona.findFirst({
        orderBy: { createdAt: "asc" }
      });

      await prisma.user.create({
        data: {
          email: user.email,
          name: user.name || user.email,
          role,
          personaId: defaultPersona?.id
        }
      });

      return true;
    },
    async jwt({ token }) {
      if (!token.email || !isDatabaseConfigured()) {
        return token;
      }

      const dbUser = await prisma.user.findUnique({
        where: { email: token.email },
        select: { id: true, role: true, personaId: true }
      });

      if (dbUser) {
        token.userId = dbUser.id;
        token.role = dbUser.role.toLowerCase();
        token.personaId = dbUser.personaId ?? "";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? "");
        session.user.role = String(token.role ?? "member");
        session.user.personaId = String(token.personaId ?? "");
      }

      return session;
    }
  }
});
