import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const OPTIONS: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,

    providers: [
      GoogleProvider({
        clientId: process.env.AUTH_GOOGLE_ID as string,
        clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
        allowDangerousEmailAccountLinking: true,
        httpOptions: {
          timeout: 30000, // e.g. 30s
        },
      }),
    ],
  
    session: {
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
  
    callbacks: {
      async jwt({ token, user }) {
        // user is only passed the first time JWT is created
        if (user) {
          token.id = user.id;
          token.email = user.email;
          token.name = user.name;
          token.image = user.image;
        }
        return token;
      },
  
      async session({ session, token }) {
        // put token values into session.user
        if (session.user) {
          session.user.id = token.id as string;
          session.user.email = token.email as string;
          session.user.name = token.name as string;
          session.user.image = token.image as string;
        }
        return session;
      },
    },
  };

export const authOptions = OPTIONS;