import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export const storage = {
    setItem: async (key: string, value: string) => {
        if(isWeb) {
            return AsyncStorage.setItem(key, value);
        } else {
            return SecureStore.setItemAsync(key, value);
        }
    },
    getItem: async (key: string) => {
        if(isWeb) {
            return AsyncStorage.getItem(key);
        } else {
            return SecureStore.getItemAsync(key);
        }
    },
    deleteItem: async (key: string) => {
        if(isWeb) {
            return AsyncStorage.removeItem(key);
        } else {
            return SecureStore.deleteItemAsync(key);
        }
    }
};