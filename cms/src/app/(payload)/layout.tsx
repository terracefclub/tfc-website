import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import React from 'react'
import { headers } from 'next/headers'
import { editorialEnabled } from '../../auth/editorial-policy'
import { editorialSession } from '../../auth/editorial-session'
import { importMap } from './admin/importMap.js'

const serverFunction: ServerFunctionClient = async (args) => {
  'use server'
  if (editorialEnabled() && !editorialSession().csrf(await headers(), 'POST')) {
    throw new Error('Invalid editorial request origin.')
  }
  return handleServerFunctions({ ...args, config, importMap })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>{children}</RootLayout>
}
