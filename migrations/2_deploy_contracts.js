const DecentralizedGallery = artifacts.require("DecentralizedGallery");

module.exports = function (deployer) {
  deployer.deploy(DecentralizedGallery);
};