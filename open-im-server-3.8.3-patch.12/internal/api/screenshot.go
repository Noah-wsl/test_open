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

package api

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openimsdk/open-im-server/v3/pkg/apistruct"
	"github.com/openimsdk/open-im-server/v3/pkg/common/storage/database"
	"github.com/openimsdk/open-im-server/v3/pkg/common/storage/model"
	"github.com/openimsdk/protocol/third"
	"github.com/openimsdk/tools/a2r"
	"github.com/openimsdk/tools/apiresp"
	"github.com/openimsdk/tools/errs"
	"github.com/openimsdk/tools/mcontext"
	"github.com/openimsdk/tools/utils/idutil"
)

type ScreenshotApi struct {
	Client       third.ThirdClient
	screenshotDB database.ScreenshotInterface
}

func NewScreenshotApi(client third.ThirdClient, screenshotDB database.ScreenshotInterface) ScreenshotApi {
	return ScreenshotApi{Client: client, screenshotDB: screenshotDB}
}

// InitUpload 初始化截图上传
func (s *ScreenshotApi) InitUpload(c *gin.Context) {
	opt := setURLPrefixOption(third.ThirdClient.InitiateMultipartUpload, func(req *third.InitiateMultipartUploadReq) error {
		return setURLPrefix(c, &req.UrlPrefix)
	})
	a2r.Call(c, third.ThirdClient.InitiateMultipartUpload, s.Client, opt)
}

// CompleteUpload 完成截图上传，并将元数据持久化到 MongoDB
func (s *ScreenshotApi) CompleteUpload(c *gin.Context) {
	type completeReq struct {
		UploadID    string   `json:"uploadID"    binding:"required"`
		Parts       []string `json:"parts"       binding:"required"`
		Name        string   `json:"name"        binding:"required"`
		ContentType string   `json:"contentType" binding:"required"`
		Cause       string   `json:"cause"`
		UserID      string   `json:"userID"      binding:"required"`
		Width       int32    `json:"width"       binding:"required"`
		Height      int32    `json:"height"      binding:"required"`
		DeviceInfo  string   `json:"deviceInfo"`
		FileSize    int64    `json:"fileSize"`
	}
	var req completeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		apiresp.GinError(c, errs.ErrArgs.WithDetail(err.Error()).Wrap())
		return
	}

	grpcReq := &third.CompleteMultipartUploadReq{
		UploadID:    req.UploadID,
		Parts:       req.Parts,
		Name:        req.Name,
		ContentType: req.ContentType,
		Cause:       req.Cause,
	}
	if err := setURLPrefix(c, &grpcReq.UrlPrefix); err != nil {
		apiresp.GinError(c, err)
		return
	}

	resp, err := s.Client.CompleteMultipartUpload(c, grpcReq)
	if err != nil {
		apiresp.GinError(c, err)
		return
	}

	// 持久化截图记录到 MongoDB
	if s.screenshotDB != nil {
		now := time.Now()
		sc := &model.Screenshot{
			UUID:        idutil.GetMsgIDByMD5(req.UserID + req.Name + string(rune(now.Nanosecond()))),
			UserID:      req.UserID,
			ObjectKey:   req.Name,
			SourceURL:   resp.Url,
			FileName:    req.Name,
			ContentType: req.ContentType,
			Width:       req.Width,
			Height:      req.Height,
			Size:        req.FileSize,
			DeviceInfo:  req.DeviceInfo,
			Status:      1,
			CreateTime:  now,
		}
		if err := s.screenshotDB.Create(c, sc); err != nil {
			apiresp.GinError(c, errs.WrapMsg(err, "save screenshot metadata failed"))
			return
		}
	}

	apiresp.GinSuccess(c, resp)
}

// ListScreenshots 截图列表
func (s *ScreenshotApi) ListScreenshots(c *gin.Context) {
	if s.screenshotDB == nil {
		apiresp.GinError(c, errs.New("screenshot database not initialized").Wrap())
		return
	}
	req := apistruct.ScreenshotListReq{}
	if err := c.BindJSON(&req); err != nil {
		apiresp.GinError(c, errs.ErrArgs.WithDetail(err.Error()).Wrap())
		return
	}
	var (
		startTime time.Time
		endTime   time.Time
	)
	if req.StartTime > 0 {
		startTime = time.UnixMilli(req.StartTime)
	}
	if req.EndTime > 0 {
		endTime = time.UnixMilli(req.EndTime)
	}
	screenshots, total, err := s.screenshotDB.FindByUserID(c, req.UserID, startTime, endTime, req.PageNumber, req.ShowNumber)
	if err != nil {
		apiresp.GinError(c, errs.WrapMsg(err, "query screenshots failed"))
		return
	}
	records := make([]*apistruct.ScreenshotRecord, 0, len(screenshots))
	for _, sc := range screenshots {
		records = append(records, modelToRecord(sc))
	}
	apiresp.GinSuccess(c, &apistruct.ScreenshotListResp{
		Total:       int32(total),
		Screenshots: records,
	})
}

// DeleteScreenshot 删除截图（软删除）
func (s *ScreenshotApi) DeleteScreenshot(c *gin.Context) {
	if s.screenshotDB == nil {
		apiresp.GinError(c, errs.New("screenshot database not initialized").Wrap())
		return
	}
	req := struct {
		UUID string `json:"uuid" binding:"required"`
	}{}
	if err := c.BindJSON(&req); err != nil {
		apiresp.GinError(c, errs.ErrArgs.WithDetail(err.Error()).Wrap())
		return
	}
	// 查询截图是否存在且未被删除（Take 内部已过滤 status=1）
	sc, err := s.screenshotDB.Take(c, req.UUID)
	if err != nil {
		apiresp.GinError(c, errs.WrapMsg(err, "screenshot not found"))
		return
	}
	opUserID := mcontext.GetOpUserID(c)
	if sc.UserID != opUserID {
		apiresp.GinError(c, errs.ErrNoPermission.WrapMsg("not your screenshot"))
		return
	}
	if err := s.screenshotDB.Delete(c, req.UUID); err != nil {
		apiresp.GinError(c, errs.WrapMsg(err, "delete screenshot failed"))
		return
	}
	apiresp.GinSuccess(c, nil)
}

// BatchDeleteScreenshots 批量删除截图（软删除）
func (s *ScreenshotApi) BatchDeleteScreenshots(c *gin.Context) {
	if s.screenshotDB == nil {
		apiresp.GinError(c, errs.New("screenshot database not initialized").Wrap())
		return
	}
	req := struct {
		UUIDs []string `json:"uuids" binding:"required,min=1"`
	}{}
	if err := c.BindJSON(&req); err != nil {
		apiresp.GinError(c, errs.ErrArgs.WithDetail(err.Error()).Wrap())
		return
	}
	if len(req.UUIDs) > 100 {
		apiresp.GinError(c, errs.ErrArgs.WrapMsg("batch delete limit exceeded, max 100"))
		return
	}
	opUserID := mcontext.GetOpUserID(c)
	// 逐个校验截图归属（Take 已过滤 status=1）
	for _, uid := range req.UUIDs {
		sc, err := s.screenshotDB.Take(c, uid)
		if err != nil {
			apiresp.GinError(c, errs.WrapMsg(err, "screenshot not found", "uuid", uid))
			return
		}
		if sc.UserID != opUserID {
			apiresp.GinError(c, errs.ErrNoPermission.WrapMsg("not your screenshot", "uuid", uid))
			return
		}
	}
	if err := s.screenshotDB.BatchDelete(c, req.UUIDs); err != nil {
		apiresp.GinError(c, errs.WrapMsg(err, "batch delete failed"))
		return
	}
	apiresp.GinSuccess(c, nil)
}

func modelToRecord(sc *model.Screenshot) *apistruct.ScreenshotRecord {
	return &apistruct.ScreenshotRecord{
		UUID:         sc.UUID,
		UserID:       sc.UserID,
		SourceURL:    sc.SourceURL,
		ThumbnailURL: sc.ThumbnailURL,
		Width:        sc.Width,
		Height:       sc.Height,
		Size:         sc.Size,
		DeviceInfo:   sc.DeviceInfo,
		CreatedAt:    sc.CreateTime.UnixMilli(),
	}
}
