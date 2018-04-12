import { EventData } from 'tns-core-modules/data/observable';
import { Page } from 'tns-core-modules/ui/page';
import { MainViewModel } from './main-view-model';
import * as pages from "tns-core-modules/ui/page";

export function onShownModally(args: pages.ShownModallyData) {
    let page = <Page>args.object;
    let viewModel = new MainViewModel();
    viewModel.imagePickerSourceView = page;

    page.bindingContext = viewModel;
}