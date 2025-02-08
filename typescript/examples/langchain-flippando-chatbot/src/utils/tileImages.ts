import fs from "fs"
import path from "path"

const tileImages: { [key: string]: { [key: string]: string } } = {}

// Load SVG files
const tileTypes = ["squares", "dice", "hexagrams"]
const gradientTypes = ["Grey", "Red", "Green", "Blue"]

tileTypes.forEach((type) => {
  const folderPath = path.join(__dirname, "..", "assets", type)
  const files = fs.readdirSync(folderPath)

  files.forEach((file) => {
    if (file.endsWith(".svg")) {
      const content = fs.readFileSync(path.join(folderPath, file), "utf8")
      const baseName = path.basename(file, ".svg")

      if (type === "squares") {
        if (baseName.startsWith("Color")) {
          tileImages.squareTile = tileImages.squareTile || {}
          tileImages.squareTile[baseName] = content
        } else {
          const gradientType = gradientTypes.find((gt) => baseName.startsWith(gt))
          if (gradientType) {
            const key = gradientType.toLowerCase() + "Gradient"
            tileImages[key] = tileImages[key] || {}
            tileImages[key][baseName] = content
          }
        }
      } else if (type === "dice") {
        tileImages.diceTile = tileImages.diceTile || {}
        tileImages.diceTile[baseName] = content
      } else if (type === "hexagrams") {
        tileImages.hexagramTile = tileImages.hexagramTile || {}
        tileImages.hexagramTile[baseName] = content
      }
    }
  })
})

export function getTileImage(index: number, tileType: string): string {
  const tileSet = tileImages[tileType]
  if (!tileSet) {
    throw new Error(`Invalid tile type: ${tileType}`)
  }

  const keys = Object.keys(tileSet).sort((a, b) => {
    const aNum = Number.parseInt(a.replace(/\D/g, ""))
    const bNum = Number.parseInt(b.replace(/\D/g, ""))
    return aNum - bNum
  })

  if (index < 0 || index >= keys.length) {
    throw new Error(`Invalid tile index: ${index}`)
  }

  return tileSet[keys[index]]
}

