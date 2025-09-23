import React from 'react'
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import AuthPage from '@/components/AuthPage'

const AuthRoute = async() => {
  const session = await getServerSession()
  if(session){
    redirect('/dash')
  }
    return (
    <AuthPage/>
    );
  }

export default AuthRoute;