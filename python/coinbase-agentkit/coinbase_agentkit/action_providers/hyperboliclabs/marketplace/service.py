"""Service for marketplace-related operations."""

from ..constants import MARKETPLACE_BASE_URL, MARKETPLACE_ENDPOINTS
from ..service import Base
from .models import (
    AvailableInstancesResponse,
    InstanceHistoryResponse,
    RentedInstancesResponse,
    RentInstanceRequest,
    RentInstanceResponse,
    TerminateInstanceRequest,
    TerminateInstanceResponse,
)
import json
import logging


class MarketplaceService(Base):
    """Service for marketplace-related operations."""

    def __init__(self, api_key: str):
        """Initialize the marketplace service.

        Args:
            api_key: The API key for authentication.

        """
        super().__init__(api_key, MARKETPLACE_BASE_URL)

    def get_available_instances(self) -> AvailableInstancesResponse:
        """Get available GPU instances from the marketplace.

        Returns:
            AvailableInstancesResponse: The marketplace instances data.

        """
        response = self.make_request(
            endpoint=MARKETPLACE_ENDPOINTS["LIST_INSTANCES"], method="POST", data={"filters": {}}
        )
        return AvailableInstancesResponse(**response.json())

    def get_instance_history(self) -> InstanceHistoryResponse:
        """Get GPU instance rental history.

        Returns:
            InstanceHistoryResponse: The instance history data.

        """
        response = self.make_request(
            endpoint=MARKETPLACE_ENDPOINTS["INSTANCE_HISTORY"], method="GET"
        )
        return InstanceHistoryResponse(**response.json())

    def get_rented_instances(self) -> RentedInstancesResponse:
        """Get currently rented GPU instances.

        Returns:
            RentedInstancesResponse: The rented instances data.

        """
        logging.info("Fetching rented instances from the Hyperbolic API")
        response = self.make_request(
            endpoint=MARKETPLACE_ENDPOINTS["LIST_USER_INSTANCES"], method="GET"
        )
        
        # Log the raw response for debugging
        response_json = response.json()
        logging.info(f"Raw API response: {json.dumps(response_json, indent=2)}")
        
        # Parse the response into a Pydantic model
        parsed_response = RentedInstancesResponse(**response_json)
        
        # Log the parsed instances for debugging
        for i, instance in enumerate(parsed_response.instances):
            logging.info(f"Instance {i+1}:")
            logging.info(f"  ID: {instance.id}")
            logging.info(f"  Status: {instance.status}")
            logging.info(f"  ssh_command: {instance.ssh_command}")
            if instance.ssh_access:
                logging.info(f"  SSH Access: host={instance.ssh_access.host}, username={instance.ssh_access.username}")
            else:
                logging.info("  SSH Access: None")
                
        return parsed_response

    def rent_instance(
        self,
        request: RentInstanceRequest,
    ) -> RentInstanceResponse:
        """Rent a GPU compute instance.

        Args:
            request: The RentInstanceRequest object containing rental parameters.

        Returns:
            RentInstanceResponse: The rental response data.

        """
        response = self.make_request(
            endpoint=MARKETPLACE_ENDPOINTS["CREATE_INSTANCE"], data=request.model_dump()
        )
        return RentInstanceResponse(**response.json())

    def terminate_instance(
        self,
        request: TerminateInstanceRequest,
    ) -> TerminateInstanceResponse:
        """Terminate a GPU compute instance.

        Args:
            request: The TerminateInstanceRequest object containing the instance ID.

        Returns:
            TerminateInstanceResponse: The termination response data.

        """
        # Log request data
        logging.info(f"Making terminate_instance request with payload: {request.model_dump()}")
        
        # Make the API request
        response = self.make_request(
            endpoint=MARKETPLACE_ENDPOINTS["TERMINATE_INSTANCE"], data=request.model_dump()
        )
        
        # Log the raw API response
        logging.info(f"Raw API response status: {response.status_code}")
        logging.info(f"Raw API response headers: {response.headers}")
        logging.info(f"Raw API response body: {response.text}")
        
        # Parse the response
        data = response.json()
        logging.info(f"Parsed response data: {data}")

        # TODO: handle errors...
        
        # Create the response object
        return TerminateInstanceResponse(**data)
