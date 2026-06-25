import {Hono} from "hono";
import type {Env} from "@/types/hono";
import {errorResponse, successResponse} from "@/utils/response";
import {env} from "@/config/env";

export const updateRoutes = new Hono<Env>();

updateRoutes.get('/version', (c, next) => {
  return c.json(successResponse<{ version: string }>({version: env.APP_VERSION}));
});

updateRoutes.get('/download', async (c, next) => {
  const version = env.APP_VERSION.replaceAll(".", "");

  try {
    const file = await Bun.file(`./storage/versions/version${version}.zip`).arrayBuffer();
    return new Response(file, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="archive.zip"',
      },
    });
  } catch (error: any) {
    return c.json(errorResponse("File not found", "404", error.message), 404);
  }
});