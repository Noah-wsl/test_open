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

package model

import (
	"time"
)

type Screenshot struct {
	UUID         string    `bson:"uuid"`
	UserID       string    `bson:"user_id"`
	ObjectKey    string    `bson:"object_key"`
	SourceURL    string    `bson:"source_url"`
	ThumbnailURL string    `bson:"thumbnail_url"`
	FileName     string    `bson:"file_name"`
	ContentType  string    `bson:"content_type"`
	Width        int32     `bson:"width"`
	Height       int32     `bson:"height"`
	Size         int64     `bson:"size"`
	DeviceInfo   string    `bson:"device_info"`
	Status       int32     `bson:"status"` // 1-正常 2-已删除
	CreateTime   time.Time `bson:"create_time"`
	DeleteTime   time.Time `bson:"delete_time,omitempty"`
}

func (Screenshot) TableName() string {
	return "screenshots"
}
