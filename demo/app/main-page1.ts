import { MainViewModel } from "./main-view-model";

let modalPageModule = 'main-page';
let mainPage;

export function onTap(args) {
    mainPage.showModal(modalPageModule, null, function (arg) {
    }, false);
}
export function onPageLoaded(args) {
    mainPage = args.object;
}