import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import { getTileImage } from "../../utils/tileImages"

const GENERATE_IMAGE_FOR_FLIP_PROMPT = `
This action generates an SVG image for a solved Flippando game board.
It takes the NFT metadata as input and returns the SVG string representation of the game board.
`

export const GenerateImageForFlipSchema = z.object({
  tokenId: z.string().describe("The ID of the NFT token"),
  metadata: z
    .object({
      name: z.string(),
      description: z.string(),
      game_version: z.string(),
      game_id: z.string(),
      game_tile_type: z.string(),
      game_level: z.string(),
      game_solved_board: z.string(),
    })
    .describe("The metadata of the NFT"),
})

const tileTypeMap: { [key: string]: string } = {
  "1": "squareTile",
  "2": "greyGradient",
  "3": "redGradient",
  "4": "greenGradient",
  "5": "blueGradient",
  "6": "diceTile",
  "7": "hexagramTile",
}

function normalizeHexColor(color: string): string {
  return color.toLowerCase()
}

function extractSvgContent(svgString: string): string {
  const match = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
  return match ? match[1].trim() : ""
}

export async function generateImageForFlip(args: z.infer<typeof GenerateImageForFlipSchema>): Promise<string> {
  try {
    const { game_tile_type, game_level, game_solved_board } = args.metadata
    const tileType = tileTypeMap[game_tile_type]
    const boardSize = Number.parseInt(game_level)
    const boardDimension = Math.sqrt(boardSize)

    if (!Number.isInteger(boardDimension)) {
      throw new Error(`Invalid board size: ${boardSize}. Must be a perfect square.`)
    }

    const maxSize = 1000 // Maximum size for better quality
    const flipSize = maxSize
    const tileSize = flipSize / boardDimension
    const board = JSON.parse(game_solved_board)

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${flipSize}" height="${flipSize}" 
     viewBox="0 0 ${flipSize} ${flipSize}" 
     xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink" 
     shape-rendering="geometricPrecision" 
     text-rendering="geometricPrecision">`

    board.forEach((tileIndex: number, index: number) => {
      const row = Math.floor(index / boardDimension)
      const col = index % boardDimension
      const tileImage = getTileImage(tileIndex - 1, tileType)
      let tileContent = extractSvgContent(tileImage)

      // Normalize hex colors to lowercase
      tileContent = tileContent.replace(/#[0-9A-F]{6}/gi, (match) => normalizeHexColor(match))

      svgContent += `
        <g transform="translate(${col * tileSize}, ${row * tileSize})">
          <svg width="${tileSize}" height="${tileSize}" viewBox="0 0 25 25">
            ${tileContent}
          </svg>
        </g>
      `
    })

    svgContent += "</svg>"

    return svgContent
  } catch (error) {
    console.error("Error generating image:", error)
    throw new Error(`Error generating image: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export class GenerateImageForFlipAction implements FlippandoAction<typeof GenerateImageForFlipSchema> {
  name = "generate_image_for_flip"
  description = GENERATE_IMAGE_FOR_FLIP_PROMPT
  argsSchema = GenerateImageForFlipSchema
  func = generateImageForFlip
}

