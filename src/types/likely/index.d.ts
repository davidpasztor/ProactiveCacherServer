// Type definitions for likely
// Project: https://www.npmjs.com/package/likely
// Definitions by: David Pasztor <https://github.com/davidpasztor> 
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.7.2

/// <reference types="node" />
//import * as sylvester from "sylvester";

export = recommender;
declare namespace recommender {
    interface Model {
        rowLabels: string[];
        colLabels: string[];
        input: number[][];
        estimated: number[][];

        recommendations(row:number):number[][];
        recommendations(rowLabel:string):number[][];
    }
    interface Bias {
        average:number;
        rowBiases:number[];
        colBiases:number[];
    }
    function buildModel(inputArray: number[][],rowLabels?:string[],colLabels?:string[]):Model;
    function buildModelWithBias(inputArray: number[][], bias:number[][] | undefined, rowLabels?:string[], colLabels?:string[]):Model;
    function train(inputMatrix: number[][],bias: number[][]):Model;
    function generateRandomMatrix(rows:number,columns:number):number[][];
    function calculateError(estimated: number[][],input:number[][],bias:number[][]):number[][];
    function calculateTotalError(estimated: number[][],input:number[][]):number;
    function calculateTotalError(errorMatrix: number[][]):number;
    function calculateBias(input: number[][]):Bias;
    function calculateMatrixAverage(inputMatrix: number[][]):number;

}
