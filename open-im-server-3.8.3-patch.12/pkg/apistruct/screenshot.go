// Copyright © 2024 OpenIM. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package apistruct

// ScreenshotElem 截图消息元素
type ScreenshotElem struct {
	UUID            string       `mapstructure:"uuid"            json:"uuid"            validate:"required"`
	SourcePath      string       `mapstructure:"sourcePath"      json:"sourcePath"`
	SourceURL       string       `mapstructure:"sourceUrl"       json:"sourceUrl"       validate:"required"`
	SourceSize      int64        `mapstructure:"sourceSize"      json:"sourceSize"`
	SourceWidth     int32        `mapstructure:"sourceWidth"     json:"sourceWidth"     validate:"required"`
	SourceHeight    int32        `mapstructure:"sourceHeight"    json:"sourceHeight"    validate:"required"`
	ThumbnailURL    string       `mapstructure:"thumbnailUrl"    json:"thumbnailUrl"`
	ThumbnailWidth  int32        `mapstructure:"thumbnailWidth"  json:"thumbnailWidth"`
	ThumbnailHeight int32        `mapstructure:"thumbnailHeight" json:"thumbnailHeight"`
	CapturedAt      int64        `mapstructure:"capturedAt"      json:"capturedAt"      validate:"required"`
	DeviceInfo      string       `mapstructure:"deviceInfo"      json:"deviceInfo"`
	Annotations     []Annotation `mapstructure:"annotations"     json:"annotations"` // 截图标注
}

// Annotation 截图标注（箭头/文字/框选等）
type Annotation struct {
	Type      string `mapstructure:"type"      json:"type"      validate:"required,oneof=arrow rect circle text"`
	Color     string `mapstructure:"color"     json:"color"`
	LineWidth int32  `mapstructure:"lineWidth" json:"lineWidth"`
	X         int32  `mapstructure:"x"         json:"x"`
	Y         int32  `mapstructure:"y"         json:"y"`
	Width     int32  `mapstructure:"width"     json:"width"`
	Height    int32  `mapstructure:"height"    json:"height"`
	Text      string `mapstructure:"text"      json:"text"`
}

// ScreenshotUploadReq 截图上传请求
type ScreenshotUploadReq struct {
	UserID      string `json:"userID"      binding:"required"`
	FileName    string `json:"fileName"    binding:"required"`
	ContentType string `json:"contentType" binding:"required"` // image/png, image/jpeg
	FileSize    int64  `json:"fileSize"    binding:"required"`
	Width       int32  `json:"width"       binding:"required"`
	Height      int32  `json:"height"      binding:"required"`
	DeviceInfo  string `json:"deviceInfo"`
}

// ScreenshotUploadResp 截图上传响应
type ScreenshotUploadResp struct {
	UploadID   string `json:"uploadID"`
	UploadURL  string `json:"uploadUrl"`
	Sign       string `json:"sign"`
	ExpireTime int64  `json:"expireTime"`
	// 分片上传信息
	PartSize int64 `json:"partSize"`
	MaxParts int32 `json:"maxParts"`
}

// ScreenshotCompleteReq 截图上传完成请求
type ScreenshotCompleteReq struct {
	UploadID   string   `json:"uploadID"   binding:"required"`
	UserID     string   `json:"userID"     binding:"required"`
	FileName   string   `json:"fileName"   binding:"required"`
	Parts      []string `json:"parts"      binding:"required"` // ETag 列表
	Width      int32    `json:"width"      binding:"required"`
	Height     int32    `json:"height"     binding:"required"`
	DeviceInfo string   `json:"deviceInfo"`
}

// ScreenshotCompleteResp 截图上传完成响应
type ScreenshotCompleteResp struct {
	ObjectKey    string `json:"objectKey"`
	SourceURL    string `json:"sourceUrl"`
	ThumbnailURL string `json:"thumbnailUrl"`
	UUID         string `json:"uuid"`
	Width        int32  `json:"width"`
	Height       int32  `json:"height"`
	Size         int64  `json:"size"`
}

// ScreenshotListReq 截图列表查询请求
type ScreenshotListReq struct {
	UserID     string `json:"userID"     binding:"required"`
	StartTime  int64  `json:"startTime"`
	EndTime    int64  `json:"endTime"`
	PageNumber int32  `json:"pageNumber" binding:"required,min=1"`
	ShowNumber int32  `json:"showNumber" binding:"required,min=1,max=100"`
}

// ScreenshotListResp 截图列表查询响应
type ScreenshotListResp struct {
	Total       int32               `json:"total"`
	Screenshots []*ScreenshotRecord `json:"screenshots"`
}

// ScreenshotRecord 截图记录
type ScreenshotRecord struct {
	UUID         string `json:"uuid"`
	UserID       string `json:"userID"`
	SourceURL    string `json:"sourceUrl"`
	ThumbnailURL string `json:"thumbnailUrl"`
	Width        int32  `json:"width"`
	Height       int32  `json:"height"`
	Size         int64  `json:"size"`
	DeviceInfo   string `json:"deviceInfo"`
	CreatedAt    int64  `json:"createdAt"`
}
