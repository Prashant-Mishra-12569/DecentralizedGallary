import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import DecentralizedGallery from './contracts/DecentralizedGallery.json';

const PINATA_API_KEY = '2d0da593c5427cd14906';
const PINATA_SECRET_API_KEY = '2d9032f3e00dd24111708919d632bed0dece19ed56f92c08e76765bbf47970c0';
const CONTRACT_ADDRESS = '0x4486006F5a38e07fF4b10a93e0383d090af235E2';

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [images, setImages] = useState([]);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });
  const [networkName, setNetworkName] = useState('');

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          
          const network = await web3Provider.getNetwork();
          setNetworkName(network.name);
          
          const signer = web3Provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);

          const instance = new ethers.Contract(
            CONTRACT_ADDRESS,
            DecentralizedGallery.abi,
            signer
          );

          setContract(instance);
          await loadImages(instance, address);

          window.ethereum.on('chainChanged', () => window.location.reload());
          window.ethereum.on('accountsChanged', async (accounts) => {
            if (accounts.length > 0) {
              setAccount(accounts[0]);
              await loadImages(instance, accounts[0]);
            } else {
              setAccount('');
              setImages([]);
            }
          });
        } catch (error) {
          console.error("Error initializing the app:", error);
          setStatusMessage({ 
            text: `Failed to initialize: ${error.message}`, 
            isError: true 
          });
        }
      } else {
        setStatusMessage({ 
          text: "Please install MetaMask to use this application", 
          isError: true 
        });
      }
    };

    init();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('chainChanged');
        window.ethereum.removeAllListeners('accountsChanged');
      }
    };
  }, []);

  const loadImages = async (instance, currentAccount) => {
    try {
      const imageCount = await instance.getImageCount();
      const loadedImages = [];
      
      for (let i = 0; i < imageCount; i++) {
        try {
          const image = await instance.getImage(i);
          if (image[1].toLowerCase() === currentAccount.toLowerCase()) {
            loadedImages.push({ 
              id: i, 
              ipfsHash: image[0], 
              owner: image[1],
              timestamp: Date.now() - (i * 1000 * 60 * 60) // Mock timestamp for demo
            });
          }
        } catch (error) {
          console.error(`Error loading image ${i}:`, error);
        }
      }
      setImages(loadedImages);
    } catch (error) {
      setStatusMessage({ 
        text: `Failed to load images: ${error.message}`, 
        isError: true 
      });
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      setStatusMessage({ text: '', isError: false });
    } else {
      setStatusMessage({ 
        text: "Please select a valid image file", 
        isError: true 
      });
    }
  };

  const uploadToPinata = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          maxBodyLength: "Infinity",
          headers: {
            'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
            'pinata_api_key': PINATA_API_KEY,
            'pinata_secret_api_key': PINATA_SECRET_API_KEY
          }
        }
      );
      return res.data.IpfsHash;
    } catch (error) {
      throw new Error(`Failed to upload to IPFS: ${error.message}`);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatusMessage({ text: "Please select a file first", isError: true });
      return;
    }

    setIsUploading(true);
    setStatusMessage({ text: '', isError: false });

    try {
      const ipfsHash = await uploadToPinata();

      const tx = await contract.uploadImage(ipfsHash);
      setStatusMessage({ 
        text: "Transaction submitted. Waiting for confirmation...", 
        isError: false 
      });
      
      await tx.wait();
      setStatusMessage({ 
        text: "Image uploaded successfully!", 
        isError: false 
      });
      
      await loadImages(contract, account);
      setFile(null);
      document.getElementById('fileInput').value = '';
    } catch (error) {
      console.error("Upload error:", error);
      setStatusMessage({ 
        text: error.code === 4001 
          ? "Transaction was rejected in MetaMask" 
          : `Upload failed: ${error.message}`,
        isError: true 
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div>
              <h1 className="text-2xl font-semibold">Decentralized Gallery</h1>
            </div>
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <p>Connected Account: {account || 'Not connected'}</p>
                <p>Network: {networkName || 'Unknown'}</p>
                {statusMessage.text && (
                  <div className={`p-4 rounded-md ${statusMessage.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {statusMessage.text}
                  </div>
                )}
                <div>
                  <label htmlFor="fileInput" className="block text-sm font-medium text-gray-700">
                    Choose Image
                  </label>
                  <input
                    id="fileInput"
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*"
                    disabled={isUploading}
                    className="mt-1 block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-violet-50 file:text-violet-700
                      hover:file:bg-violet-100"
                  />
                </div>
                <button
                  onClick={handleUpload}
                  disabled={isUploading || !file || !contract}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Upload Image'}
                </button>
              </div>
              <div className="pt-6 text-base leading-6 font-bold sm:text-lg sm:leading-7">
                <p>Your Images</p>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((image) => (
                    <div key={image.id} className="relative rounded-lg overflow-hidden">
                      <img 
                        src={`https://gateway.pinata.cloud/ipfs/${image.ipfsHash}`} 
                        alt={`Image ${image.id}`}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                        <p className="text-white text-sm truncate">IPFS: {image.ipfsHash}</p>
                        <p className="text-white text-xs">
                          {new Date(image.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {images.length === 0 && (
                  <p className="text-center text-gray-500 mt-4">No images found. Upload your first image to get started!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;