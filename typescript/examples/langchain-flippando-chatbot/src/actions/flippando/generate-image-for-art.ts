import { z } from "zod"
import type { FlippandoAction } from "../flippando"
import { getTileImage } from "../../utils/tileImages"

const GENERATE_IMAGE_FOR_ART_PROMPT = `
This action generates an SVG image for a Flippando art piece composed of multiple basic flips.
It takes the art metadata as input and returns the SVG string representation of the assembled art piece.
Each flip will occupy the same width and height, with tiles scaled accordingly.
`

const tileTypeMap: { [key: string]: string } = {
  "1": "squareTile",
  "2": "greyGradient",
  "3": "redGradient",
  "4": "greenGradient",
  "5": "blueGradient",
  "6": "diceTile",
  "7": "hexagramTile",
}

export const GenerateImageForArtSchema = z.object({
  tokenId: z.string().describe("The ID of the NFT token"),
  metadata: z
    .object({
      name: z.string(),
      description: z.string(),
      width: z.number().int().min(2).max(8),
      height: z.number().int().min(2).max(8),
      tileTypes: z.array(z.number().int().min(1).max(7)),
      boards: z.array(z.array(z.array(z.number().int().min(0)))),
    })
    .describe("The metadata of the art piece"),
})

function normalizeHexColor(color: string): string {
  return color.toLowerCase()
}

function extractSvgContent(svgString: string): string {
  const match = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
  return match ? match[1].trim() : ""
}

function generateFlipSVG(board: number[], tileType: string, flipSize: number): string {
  if (!Array.isArray(board) || board.length === 0) {
    console.error("Invalid board:", board)
    return "" // Return an empty string or a placeholder SVG
  }

  const boardSize = board.length
  const boardDimension = Math.sqrt(boardSize)
  const tileSize = flipSize / boardDimension
  let svgContent = ""

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

  return svgContent
}

export async function generateImageForArt(args: z.infer<typeof GenerateImageForArtSchema>): Promise<string> {
  try {
    const { width, height, tileTypes, boards } = args.metadata

    console.log("Metadata:", JSON.stringify(args.metadata, null, 2))
    console.log("Boards structure:", JSON.stringify(boards, null, 2))
    console.log(`Dimensions: ${width}x${height}`)
    console.log("Number of boards:", boards.length)
    console.log("First board length:", boards[0]?.length)

    // Validate boards structure
    if (!Array.isArray(boards) || !Array.isArray(boards[0])) {
      throw new Error("Invalid boards structure")
    }

    const totalBoards = width * height
    if (boards[0].length < totalBoards) {
      throw new Error(`Not enough boards: expected ${totalBoards}, got ${boards[0].length}`)
    }

    if (tileTypes.length !== totalBoards) {
      throw new Error(`Mismatch between number of tileTypes (${tileTypes.length}) and total boards (${totalBoards})`)
    }

    const maxSize = 1000 // Maximum size for better quality
    const flipSize = Math.floor(maxSize / Math.max(width, height))
    const svgSize = { width: width * flipSize, height: height * flipSize }

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgSize.width}" height="${svgSize.height}" 
     viewBox="0 0 ${svgSize.width} ${svgSize.height}" 
     xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink" 
     shape-rendering="geometricPrecision" 
     text-rendering="geometricPrecision">`

    // Generate each flip
    for (let i = 0; i < totalBoards; i++) {
      const row = Math.floor(i / width)
      const col = i % width
      const tileType = tileTypeMap[tileTypes[i].toString()]
      const board = boards[0][i]

      console.log(`Processing board ${i}:`, {
        position: { row, col },
        tileType,
        boardLength: board?.length,
      })

      const flipSVG = generateFlipSVG(board, tileType, flipSize)

      svgContent += `
        <g transform="translate(${col * flipSize}, ${row * flipSize})">
          ${flipSVG}
        </g>
      `
    }

    svgContent += "</svg>"
    return svgContent
  } catch (error) {
    console.error("Error generating image for art:", error)
    throw new Error(`Error generating image for art: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export class GenerateImageForArtAction implements FlippandoAction<typeof GenerateImageForArtSchema> {
  name = "generate_image_for_art"
  description = GENERATE_IMAGE_FOR_ART_PROMPT
  argsSchema = GenerateImageForArtSchema
  func = generateImageForArt
}

