import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import type { FlippandoAgentkit } from "../../flippando-agentkit"
import { TwitterApi } from "twitter-api-v2"
import * as fs from "fs"
import * as path from "path"
import sharp from "sharp"
import { GetArtMetadataAction } from "./get-art-metadata"
import { GenerateImageForArtAction } from "./generate-image-for-art"

const POST_ART_TO_TWITTER_PROMPT = `
This action posts a message to Twitter using the Flippando agent's Twitter account.
It takes a message and an art token ID as input, retrieves the metadata, generates the SVG image for the art,
converts it to a PNG image, and posts the tweet with the attached image.
`

export const PostArtToTwitterSchema = z.object({
  message: z.string().max(280, "Tweet cannot exceed 280 characters").describe("The message to post on Twitter"),
  tokenId: z.string().describe("The Art token ID to generate the image from"),
})

export const PostArtToTwitterResponseSchema = z.object({
  tweetUrl: z.string().url(),
  message: z.string(),
})

export class PostArtToTwitterAction
  implements FlippandoAction<typeof PostArtToTwitterSchema, typeof PostArtToTwitterResponseSchema>
{
  name = "post_art_to_twitter"
  description = POST_ART_TO_TWITTER_PROMPT
  argsSchema = PostArtToTwitterSchema
  responseSchema = PostArtToTwitterResponseSchema

  async func(
    args: z.infer<typeof PostArtToTwitterSchema>,
    agentkit: FlippandoAgentkit,
  ): Promise<z.infer<typeof PostArtToTwitterResponseSchema>> {
    try {
      const twitterClient = new TwitterApi({
        appKey: agentkit.getTwitterApiKey(),
        appSecret: agentkit.getTwitterApiSecret(),
        accessToken: agentkit.getTwitterAccessToken(),
        accessSecret: agentkit.getTwitterAccessSecret(),
      })

      let mediaId: string | undefined

      // Get Art metadata
      const getArtMetadataAction = new GetArtMetadataAction()
      const { metadata } = await getArtMetadataAction.func({ tokenId: args.tokenId }, agentkit)

      // Generate SVG for the flip
      const generateImageAction = new GenerateImageForArtAction()
      const svgString = await generateImageAction.func({ tokenId: args.tokenId, metadata })

      console.log("SVG string length:", svgString.length)
      console.log("SVG string preview:", svgString.substring(0, 200) + "...")

      const tempDir = path.join(__dirname, "temp")
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir)
      }
      const svgPath = path.join(tempDir, "temp.svg")
      const pngPath = path.join(tempDir, "temp.png")

      // Save SVG to file for debugging
      fs.writeFileSync(svgPath, svgString)
      console.log("SVG saved to:", svgPath)

      try {
        // Process SVG with Sharp
        const image = sharp(Buffer.from(svgString))
        const imageMetadata = await image.metadata()
        console.log("Sharp metadata:", imageMetadata)

        await image.png().toFile(pngPath)

        console.log("PNG saved to:", pngPath)

        const pngBuffer = fs.readFileSync(pngPath)
        console.log("PNG buffer size:", pngBuffer.length)

        // Upload the image to Twitter
        mediaId = await twitterClient.v1.uploadMedia(pngBuffer, { mimeType: "image/png" })
        console.log("Media uploaded to Twitter, ID:", mediaId)
      } catch (sharpError) {
        console.error("Error processing image with Sharp:", sharpError)
        throw sharpError
      }

      // Comment out the cleanup for now
      // fs.unlinkSync(svgPath)
      // fs.unlinkSync(pngPath)
      console.log("Temporary files kept for inspection at:", tempDir)

      // Post the tweet with or without the uploaded image
      const { data: createdTweet } = await twitterClient.v2.tweet(
        args.message,
        mediaId ? { media: { media_ids: [mediaId] } } : undefined,
      )

      const tweetUrl = `https://twitter.com/user/status/${createdTweet.id}`

      return {
        tweetUrl,
        message: mediaId
          ? `Successfully posted tweet with image: ${args.message}`
          : `Successfully posted tweet: ${args.message}`,
      }
    } catch (error) {
      console.error("Error posting to Twitter:", error)
      throw new Error(`Error posting to Twitter: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

