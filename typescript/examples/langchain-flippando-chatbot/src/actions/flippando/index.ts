import { z } from "zod"
import { FlippandoAction, FlippandoActionSchemaAny } from "../flippando"
import { CreateGameAction } from "./create-game"
import { InitializeGameAction } from "./initialize-game"
import { FlipTilesAction } from "./flip-tiles"
import { MintNftAction } from "./mint-nft"
import { GetFlipMetadataAction } from "./get-flip-metadata"
import { GenerateImageForFlipAction } from "./generate-image-for-flip"
import { GetAvailableNftsAction } from "./get-available-nfts"
import { GetArtMetadataAction } from "./get-art-metadata"
import { GenerateImageForArtAction } from "./generate-image-for-art"
import { ChangeFlippingTerritoryAction } from "./change-flipping-territory"
import { MakeArtAction } from "./make-art"
import { PostFlipToTwitterAction } from "./post-flip-to-twitter"
import { PostArtToTwitterAction } from "./post-art-to-twitter"
import { PlayGameToCompletionAction } from "./play-game-to-completion"
import { MakeArtSuggestionsAction } from "./make-art-suggestion"
import { GenerateImageForArtSuggestionAction } from "./generate-image-for-art-suggestion"
import { PostArtSuggestionToTwitterAction } from "./post-art-suggestion-to-twitter"
import { GetAvailableFlippingTerritoriesAction } from "./get-available-networks"
import { GetTotalFlipndSupplyAction } from "./get-total-flipnd-supply"
import { GetArtworksAction } from "./get-artworks"


export function getAllFlippandoActions(): FlippandoAction<FlippandoActionSchemaAny, z.ZodType<any, any, any>>[] {
    return [
        new CreateGameAction(), 
        new InitializeGameAction(), 
        new FlipTilesAction(),
        new MintNftAction(),
        new GenerateImageForFlipAction(),
        new GetFlipMetadataAction(),
        new GetAvailableNftsAction(),
        new ChangeFlippingTerritoryAction(),
        new MakeArtAction(),
        new PostFlipToTwitterAction(),
        new PostArtToTwitterAction(),
        new PlayGameToCompletionAction(),
        new GetArtMetadataAction(),
        new GenerateImageForArtAction(),
        new MakeArtSuggestionsAction(),
        new GenerateImageForArtSuggestionAction(),
        new PostArtSuggestionToTwitterAction(),
        new GetAvailableFlippingTerritoriesAction(),
        new GetTotalFlipndSupplyAction(),
        new GetArtworksAction(),
    ];
  }
  
  /**
   * All available Flippando actions.
   */
  export const FLIPPANDO_ACTIONS = getAllFlippandoActions();

  export {
    FlippandoAction,
    FlippandoActionSchemaAny,
    CreateGameAction,
    InitializeGameAction,
    FlipTilesAction,
    MintNftAction,
    GenerateImageForFlipAction,
    GetFlipMetadataAction,
    GetAvailableNftsAction,
    ChangeFlippingTerritoryAction,
    MakeArtAction,
    PostFlipToTwitterAction,
    PostArtToTwitterAction,
    PlayGameToCompletionAction,
    GetArtMetadataAction,
    GenerateImageForArtAction,
    MakeArtSuggestionsAction,
    GenerateImageForArtSuggestionAction,
    PostArtSuggestionToTwitterAction,
    GetAvailableFlippingTerritoriesAction,
    GetTotalFlipndSupplyAction,
    GetArtworksAction,
  }



