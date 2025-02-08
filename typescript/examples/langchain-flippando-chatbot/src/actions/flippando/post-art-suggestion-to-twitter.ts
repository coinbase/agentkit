import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import type { FlippandoAgentkit } from "../../flippando-agentkit"
import { TwitterApi } from "twitter-api-v2"
import * as fs from "fs"
import * as path from "path"
import sharp from "sharp"
import { GenerateImageForArtSuggestionAction } from "./generate-image-for-art-suggestion"
import { MakeArtSuggestionsAction } from "./make-art-suggestion"

const POST_ART_SUGGESTION_TO_TWITTER_PROMPT = `
This action posts a message to Twitter using the Flippando agent's Twitter account.
It takes a message and a player address as input, generates an art suggestion,
converts it to a PNG image, and posts the tweet with the attached image.
`

export const PostArtSuggestionToTwitterSchema = z.object({
  message: z.string().max(280, "Tweet cannot exceed 280 characters").describe("The message to post on Twitter"),
  playerAddress: z.string().describe("The Ethereum address of the player"),
})

export const PostArtSuggestionToTwitterResponseSchema = z.object({
  tweetUrl: z.string().url(),
  message: z.string(),
})

export class PostArtSuggestionToTwitterAction
  implements FlippandoAction<typeof PostArtSuggestionToTwitterSchema, typeof PostArtSuggestionToTwitterResponseSchema>
{
  name = "post_art_suggestion_to_twitter"
  description = POST_ART_SUGGESTION_TO_TWITTER_PROMPT
  argsSchema = PostArtSuggestionToTwitterSchema
  responseSchema = PostArtSuggestionToTwitterResponseSchema

  async func(
    args: z.infer<typeof PostArtSuggestionToTwitterSchema>,
    agentkit: FlippandoAgentkit,
  ): Promise<z.infer<typeof PostArtSuggestionToTwitterResponseSchema>> {
    try {
      const twitterClient = new TwitterApi({
        appKey: agentkit.getTwitterApiKey(),
        appSecret: agentkit.getTwitterApiSecret(),
        accessToken: agentkit.getTwitterAccessToken(),
        accessSecret: agentkit.getTwitterAccessSecret(),
      })

      let mediaId: string | undefined

      // Get Art suggestions
      const makeArtSuggestionsAction = new MakeArtSuggestionsAction()
      const { suggestions } = await makeArtSuggestionsAction.func({ playerAddress: args.playerAddress }, agentkit)

      if (suggestions.length === 0) {
        throw new Error("No art suggestions available for the player")
      }

      // Generate SVG for the first suggestion
      const generateImageAction = new GenerateImageForArtSuggestionAction()
      const svgString = await generateImageAction.func({ metadata: suggestions[0] })

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

