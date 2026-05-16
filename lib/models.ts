import {
  getAllowedChatModels,
  getAllowedImageModels,
  getDefaultChatModel,
  getDefaultImageModel
} from "./config";

export {
  getAllowedChatModels as allowedChatModels,
  getAllowedImageModels as allowedImageModels,
  getDefaultChatModel as defaultChatModel,
  getDefaultImageModel as defaultImageModel
};

export async function assertAllowedChatModel(model: string) {
  if (!(await getAllowedChatModels()).includes(model)) {
    throw new Error("不支持的文本模型");
  }
}

export async function assertAllowedImageModel(model: string) {
  if (!(await getAllowedImageModels()).includes(model)) {
    throw new Error("不支持的图片模型");
  }
}
