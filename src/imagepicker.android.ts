import * as application from "tns-core-modules/application";
import * as imageAssetModule from "tns-core-modules/image-asset";
import * as permissions from "nativescript-permissions";
import {File} from "tns-core-modules/file-system";
import * as utils from "tns-core-modules/utils/utils";

import { ImagePickerMediaType, Options } from "./imagepicker.common";
export * from "./imagepicker.common";

declare const global: any;

class UriHelper {
    public static _calculateFileUri(uri: android.net.Uri) {
        let DocumentsContract = (<any>android.provider).DocumentsContract;
        let isKitKat = android.os.Build.VERSION.SDK_INT >= 19; // android.os.Build.VERSION_CODES.KITKAT

        if (isKitKat && DocumentsContract.isDocumentUri(application.android.context, uri)) {
            let docId, id, type;
            let contentUri: android.net.Uri = null;

            // ExternalStorageProvider
            if (UriHelper.isExternalStorageDocument(uri)) {
                docId = DocumentsContract.getDocumentId(uri);
                id = docId.split(":")[1];
                type = docId.split(":")[0];

                if ("primary" === type.toLowerCase()) {
                    return android.os.Environment.getExternalStorageDirectory() + "/" + id;
                } else {
                    if (android.os.Build.VERSION.SDK_INT > 23) {
                        (this.getContentResolver() as any).takePersistableUriPermission(
                            uri,
                            android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION | android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
                        );
                        const externalMediaDirs = application.android.context.getExternalMediaDirs();
                        if (externalMediaDirs.length > 1) {
                            let filePath = externalMediaDirs[1].getAbsolutePath();
                            filePath = filePath.substring(0, filePath.indexOf("Android")) + id;
                            return filePath;
                        }
                    }
                }
            }
            // DownloadsProvider
            else if (UriHelper.isDownloadsDocument(uri)) {
                return UriHelper.getDataColumn(uri, null, null, true);
            }
            // MediaProvider
            else if (UriHelper.isMediaDocument(uri)) {
                docId = DocumentsContract.getDocumentId(uri);
                let split = docId.split(":");
                type = split[0];
                id = split[1];

                if ("image" === type) {
                    contentUri = android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                } else if ("video" === type) {
                    contentUri = android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                } else if ("audio" === type) {
                    contentUri = android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                }

                let selection = "_id=?";
                let selectionArgs = [id];

                return UriHelper.getDataColumn(contentUri, selection, selectionArgs, false);
            }
        }
        else {
            // MediaStore (and general)
            if ("content" === uri.getScheme()) {
                return UriHelper.getDataColumn(uri, null, null, false);
            }
            // FILE
            else if ("file" === uri.getScheme()) {
                return uri.getPath();
            }
        }

        return undefined;
    }

    private static getDataColumn(uri: android.net.Uri, selection, selectionArgs, isDownload: boolean) {
        let cursor = null;
        let filePath;
        if (isDownload) {
            let columns = ["_display_name"];
            try {
                cursor = this.getContentResolver().query(uri, columns, selection, selectionArgs, null);
                if (cursor != null && cursor.moveToFirst()) {
                    let column_index = cursor.getColumnIndexOrThrow(columns[0]);
                    filePath = cursor.getString(column_index);
                    if (filePath) {
                        const dl = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                        filePath = `${dl}/${filePath}`;
                        return filePath;
                    }
                }
            }
            catch (e) {
                console.log(e);
            }
            finally {
                if (cursor) {
                    cursor.close();
                }
            }
        }
        else {
            let columns = [android.provider.MediaStore.MediaColumns.DATA];
            let filePath;

            try {
                cursor = this.getContentResolver().query(uri, columns, selection, selectionArgs, null);
                if (cursor != null && cursor.moveToFirst()) {
                    let column_index = cursor.getColumnIndexOrThrow(columns[0]);
                    filePath = cursor.getString(column_index);
                    if (filePath) {
                        return filePath;
                    }
                }
            }
            catch (e) {
                console.log(e);
            }
            finally {
                if (cursor) {
                    cursor.close();
                }
            }
        }
        return undefined;

    }

    private static isExternalStorageDocument(uri: android.net.Uri) {
        return "com.android.externalstorage.documents" === uri.getAuthority();
    }

    private static isDownloadsDocument(uri: android.net.Uri) {
        return "com.android.providers.downloads.documents" === uri.getAuthority();
    }

    private static isMediaDocument(uri: android.net.Uri) {
        return "com.android.providers.media.documents" === uri.getAuthority();
    }

    private static getContentResolver(): android.content.ContentResolver {
        return application.android.nativeApp.getContentResolver();
    }
}

export class ImagePicker {
    private _options: Options;

    constructor(options: Options) {
        this._options = options;
    }

    get mode(): string {
        return this._options && this._options.mode && this._options.mode.toLowerCase() === 'single' ? 'single' : 'multiple';
    }

    get mediaType(): string {
        const mediaType = this._options && 'mediaType' in this._options ? this._options.mediaType : ImagePickerMediaType.Any;
        if (mediaType === ImagePickerMediaType.Image) {
            return "image/*";
        } else if (mediaType === ImagePickerMediaType.Video) {
            return "video/*";
        } else {
            return "*/*";
        }
    }

    get mimeTypes() {
        let length = this.mediaType === "*/*" ? 2 : 1;
        let mimeTypes = Array.create(java.lang.String, length);

        if (this.mediaType === "*/*") {
            mimeTypes[0] = "image/*";
            mimeTypes[1] = "video/*";
        }
        else {
            mimeTypes[0] = this.mediaType;
        }
        return mimeTypes;
    }

	get maximumNumberOfSelection() {
		if (this._options.maximumNumberOfSelection && this._options.maximumNumberOfSelection > 0) {
			return this._options.maximumNumberOfSelection;
		}

		return 0;
	}
	private get usePhotoPicker(): boolean {
        return this._options &&
            this._options.android &&
            this._options.android.use_photo_picker &&
            android &&
            android.os &&
            android.os.Build &&
            android.os.Build.VERSION &&
            android.os.Build.VERSION.SDK_INT >= 33;
		//return this._options?.android?.use_photo_picker && (<any>android).os.Build.VERSION.SDK_INT >= 33;
	}
    authorize(): Promise<void> {
		if (this.usePhotoPicker) {
            return new Promise((resolve, reject) => {
                resolve();
            });
        } else {
            let perms: String[] = [];
			let explanations: String[] = [];
            
			if (android.os.Build.VERSION.SDK_INT >= 33 && utils.ad.getApplicationContext().getApplicationInfo().targetSdkVersion >= 33) {
				if (this.mediaType === 'image/*') {
                    perms.push('android.permission.READ_MEDIA_IMAGES');
                    explanations.push("To pick images from your gallery");
				} else if (this.mediaType === 'video/*') {
                    perms.push('android.permission.READ_MEDIA_VIDEO');
                    explanations.push("To pick videos from your gallery");
				} else {
                    perms.push('android.permission.READ_MEDIA_IMAGES');
                    explanations.push("To pick images from your gallery");
                    perms.push('android.permission.READ_MEDIA_VIDEO');
                    explanations.push("To pick videos from your gallery");
				}

				var permsPromise = permissions.requestPermissions(perms, explanations)
                return new Promise((resolve, reject) => {
                    permsPromise.then((result) => {
                        console.log("requestPermissions result");
                        console.log(result);
                        resolve();
                    }).catch((error) => {
                        console.log("requestPermissions error");
                        console.log(error);
                        reject(error);
                    });
                });
			} else if (android.os.Build.VERSION.SDK_INT >= 23) {
                perms.push('android.permission.READ_EXTERNAL_STORAGE');
                explanations.push("To pick media from your gallery");
                
				var permsPromise = permissions.requestPermissions(perms, explanations)
                return new Promise((resolve, reject) => {
                    permsPromise.then((result) => {
                        console.log("requestPermissions result");
                        console.log(result);
                        resolve();
                    }).catch((error) => {
                        console.log("requestPermissions error");
                        console.log(error);
                        reject(error);
                    });
                });
			} else {
                return new Promise((resolve, reject) => {
                    resolve();
                });
			}
        }

        
    }

    present(): Promise<imageAssetModule.ImageAsset[]> {
        return new Promise((resolve, reject) => {
			if (this.usePhotoPicker) {
				const REQUEST_LAUNCH_LIBRARY = 13003;

                let Application = require("tns-core-modules/application");
				var onResult = function(args: any) {
					let requestCode = args.requestCode;
					if (requestCode === REQUEST_LAUNCH_LIBRARY) {
						let resultCode = args.resultCode;
						if (resultCode == android.app.Activity.RESULT_OK) {
							try {
								let data = args.intent;
								let uris = new Array<string>();
								let clip = data.getClipData();
								if (clip) {
									let count = clip.getItemCount();
									for (let i = 0; i < count; i++) {
										let clipItem = clip.getItemAt(i);
										if (clipItem) {
											let uri = clipItem.getUri();
											if (uri) {
												uris.push(uri.toString());
											}
										}
									}
								} else {
									const uriData = data.getData();
									const uri = uriData.toString();
									uris = [uri];
								}

								const handle = (selectedAsset, i?) => {
									const file = File.fromPath(selectedAsset.android);
									let copiedFile: any = false;

                                    return file.path;
								};

								let results = [];
								for (let i = 0; i <= uris.length - 1; ++i) {
									const selectedAsset = new imageAssetModule.ImageAsset(uris[i].toString());
									results.push(selectedAsset);
                                    console.log(selectedAsset);
								}
								Application.android.off(application.AndroidApplication.activityResultEvent, onResult);
								resolve(results);
							} catch (e) {
								Application.android.off(application.AndroidApplication.activityResultEvent, onResult);
								reject(e);
							}
						} else {
							Application.android.off(application.AndroidApplication.activityResultEvent, onResult);
							reject(new Error('Image picker activity result code ' + resultCode));
							return;
						}
					}
				}

				Application.android.on(Application.AndroidApplication.activityResultEvent, onResult);
                
                const intent = new android.content.Intent();
                const mimeType = this.mediaType || "image/*";

                if (this.mode === "multiple" && this.maximumNumberOfSelection !== 1) {
                    // Allow multiple selection
                    intent.setType(mimeType);
                    intent.putExtra("android.intent.extra.ALLOW_MULTIPLE", true);
                    intent.setAction(android.content.Intent.ACTION_GET_CONTENT);
                } else {
                    // Single selection
                    intent.setType(mimeType);
                    intent.setAction(android.content.Intent.ACTION_GET_CONTENT);
                }

                // CATEGORY_OPENABLE ensures only file-like sources appear
                intent.addCategory(android.content.Intent.CATEGORY_OPENABLE);

                // Start picker
                const activity = application.android.foregroundActivity || application.android.startActivity;
                activity.startActivityForResult(
                    android.content.Intent.createChooser(intent, "Select Media"),
                    REQUEST_LAUNCH_LIBRARY
                );
			} else {

                // WARNING: If we want to support multiple pickers we will need to have a range of IDs here:
                let RESULT_CODE_PICKER_IMAGES = 9192;

                let application = require("tns-core-modules/application");

                var onResult = function(args: any) {

                    let requestCode = args.requestCode;
                    let resultCode = args.resultCode;
                    let data = args.intent;

                    if (requestCode === RESULT_CODE_PICKER_IMAGES) {
                        if (resultCode === android.app.Activity.RESULT_OK) {

                            try {
                                let results = [];

                                let clip = data.getClipData();
                                if (clip) {
                                    let count = clip.getItemCount();
                                    for (let i = 0; i < count; i++) {
                                        let clipItem = clip.getItemAt(i);
                                        if (clipItem) {
                                            let uri = clipItem.getUri();
                                            if (uri) {
                                                let selectedAsset = new imageAssetModule.ImageAsset(UriHelper._calculateFileUri(uri));
                                                results.push(selectedAsset);
                                            }
                                        }
                                    }
                                } else {
                                    let uri = data.getData();
                                    let selectedAsset = new imageAssetModule.ImageAsset(UriHelper._calculateFileUri(uri));
                                    results.push(selectedAsset);
                                }

                                application.android.off(application.AndroidApplication.activityResultEvent, onResult);
                                resolve(results);
                                return;

                            } catch (e) {
                                application.android.off(application.AndroidApplication.activityResultEvent, onResult);
                                reject(e);
                                return;

                            }
                        } else {
                            application.android.off(application.AndroidApplication.activityResultEvent, onResult);
                            reject(new Error("Image picker activity result code " + resultCode));
                            return;
                        }
                    }
                }

                application.android.on(application.AndroidApplication.activityResultEvent, onResult);

                let Intent = android.content.Intent;
                let intent = new Intent();
                intent.setType(this.mediaType);

                // not in platform-declaration typings
                intent.putExtra((android.content.Intent as any).EXTRA_MIME_TYPES, this.mimeTypes);

                // TODO: Use (<any>android).content.Intent.EXTRA_ALLOW_MULTIPLE
                if (this.mode === 'multiple') {
                    intent.putExtra("android.intent.extra.ALLOW_MULTIPLE", true);
                }

                if (this._options.showAdvanced) {
                    intent.putExtra("android.content.extra.SHOW_ADVANCED", true);
                }

                intent.putExtra(android.content.Intent.EXTRA_LOCAL_ONLY, true);
                intent.setAction("android.intent.action.OPEN_DOCUMENT");
                let chooser = Intent.createChooser(intent, "Select Picture");
                application.android.foregroundActivity.startActivityForResult(intent, RESULT_CODE_PICKER_IMAGES);
            }
        });
    }
}

export function create(options?: Options): ImagePicker {
    return new ImagePicker(options);
}
