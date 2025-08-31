// This file provides type definitions for JSON files that are imported directly into the application.
// Using a dedicated .d.ts file ensures these declarations are treated as global ambient modules.

declare module '*/deployed-addresses.json' {
    const value: { 
        nft?: string; 
        wallet?: string; 
        factory?: string 
    };
    export default value;
}
