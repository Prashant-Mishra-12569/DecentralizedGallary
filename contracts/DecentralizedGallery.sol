// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DecentralizedGallery {
    struct Image {
        string ipfsHash;
        address owner;
    }

    Image[] public images;

    event ImageUploaded(uint256 id, string ipfsHash, address owner);

    function uploadImage(string memory _ipfsHash) public {
        images.push(Image(_ipfsHash, msg.sender));
        emit ImageUploaded(images.length - 1, _ipfsHash, msg.sender);
    }

    function getImageCount() public view returns (uint256) {
        return images.length;
    }

    function getImage(uint256 _id) public view returns (string memory, address) {
        require(_id < images.length, "Image does not exist");
        Image memory image = images[_id];
        return (image.ipfsHash, image.owner);
    }
}