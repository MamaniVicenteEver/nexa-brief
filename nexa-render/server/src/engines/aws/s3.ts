import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { writeFile } from "node:fs/promises";
import { RenderError } from "../errors.js";

export async function downloadS3Object(bucket: string, key: string, region: string, outputPath: string): Promise<void> {
  const client = new S3Client({ region });
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new RenderError(`S3 no devolvió contenido para s3://${bucket}/${key}.`);
  await writeFile(outputPath, Buffer.from(await response.Body.transformToByteArray()));
}
