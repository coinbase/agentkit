import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import type { FlippandoAgentkit } from "../../flippando-agentkit"
import { TwitterApi, type MediaObjectV2 } from "twitter-api-v2"
import * as fs from "fs"
import * as path from "path"
import sharp from "sharp"
import { GetFlipMetadataAction } from "./get-flip-metadata"
import { GenerateImageForFlipAction } from "./generate-image-for-flip"

const POST_FLIP_TO_TWITTER_PROMPT = `
This action posts a message to Twitter using the Flippando agent's Twitter account.
It takes a message and an NFT token ID as input, retrieves the metadata, generates the SVG image for the flip,
converts it to a PNG image, posts the tweet with the attached image, and retrieves the image URL from the posted tweet.
`

export const PostFlipToTwitterSchema = z.object({
  message: z.string().max(280, "Tweet cannot exceed 280 characters").describe("The message to post on Twitter"),
  tokenId: z.string().describe("The NFT token ID to generate the image from"),
})

export const PostFlipToTwitterResponseSchema = z.object({
  tweetUrl: z.string().url(),
  imageUrl: z.string().url().optional(),
  message: z.string(),
})

export class PostFlipToTwitterAction
  implements FlippandoAction<typeof PostFlipToTwitterSchema, typeof PostFlipToTwitterResponseSchema>
{
  name = "post_flip_to_twitter"
  description = POST_FLIP_TO_TWITTER_PROMPT
  argsSchema = PostFlipToTwitterSchema
  responseSchema = PostFlipToTwitterResponseSchema

  async func(
    args: z.infer<typeof PostFlipToTwitterSchema>,
    agentkit: FlippandoAgentkit,
  ): Promise<z.infer<typeof PostFlipToTwitterResponseSchema>> {
    try {
      const twitterClient = new TwitterApi({
        appKey: agentkit.getTwitterApiKey(),
        appSecret: agentkit.getTwitterApiSecret(),
        accessToken: agentkit.getTwitterAccessToken(),
        accessSecret: agentkit.getTwitterAccessSecret(),
      })

      let mediaId: string | undefined

      // Get NFT metadata
      const getFlipMetadataAction = new GetFlipMetadataAction()
      const { metadata } = await getFlipMetadataAction.func({ tokenId: args.tokenId }, agentkit)

      // Generate SVG for the flip
      const generateImageAction = new GenerateImageForFlipAction()
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

      // Post the tweet with or without the uploaded image
      const { data: createdTweet } = await twitterClient.v2.tweet(
        args.message,
        mediaId ? { media: { media_ids: [mediaId] } } : undefined,
      )

      const tweetUrl = `https://twitter.com/user/status/${createdTweet.id}`

      // Fetch the tweet to get the media URL
      const { data: tweetData, includes } = await twitterClient.v2.singleTweet(createdTweet.id, {
        expansions: ["attachments.media_keys"],
        "media.fields": ["url", "preview_image_url", "type"],
      })

      let imageUrl: string | undefined

      if (includes && includes.media && includes.media.length > 0) {
        const media = includes.media[0] as MediaObjectV2
        imageUrl = media.type === "photo" ? media.url : media.preview_image_url
      }

      return {
        tweetUrl,
        imageUrl,
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

