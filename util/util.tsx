import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

export const storage = {
    setItem: async (key: string, value: string) => {
        if(isWeb) {
            return localStorage.setItem(key, value);
        } else {
            return SecureStore.setItemAsync(key, value);
        }
    },
    getItem: async (key: string) => {
        if(isWeb) {
            return localStorage.getItem(key);
        } else {
            return SecureStore.getItemAsync(key);
        }
    },
    deleteItem: async (key: string) => {
        if(isWeb) {
            return localStorage.removeItem(key);
        } else {
            return SecureStore.deleteItemAsync(key);
        }
    }
};