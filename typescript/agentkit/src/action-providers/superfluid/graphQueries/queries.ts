import { gql } from "graphql-request";

export const getAccountOutflowQuery = gql`
  query GetAccountData($id: ID!) {
    accounts(where: { id: $id }) {
      isSuperApp
      inflows {
        currentFlowRate
        token {
          symbol
        }
        sender {
          id
        }
      }
      outflows {
        currentFlowRate
        token {
          symbol
        }
        receiver {
          id
        }
      }
      accountTokenSnapshots {
        token {
          id
        }
        totalNumberOfActiveStreams
        totalNetFlowRate
      }
    }
  }
`;
